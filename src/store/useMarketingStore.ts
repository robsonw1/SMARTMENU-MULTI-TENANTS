import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface CampaignAnalytics {
  campaign_id: string;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  delivery_rate: number;
  read_rate: number;
  click_rate: number;
  conversion_rate: number;
  orders_generated: number;
  revenue_generated: number;
}

interface MarketingStore {
  campaigns: Campaign[];
  analytics: Record<string, CampaignAnalytics>;
  loading: boolean;
  error: string | null;

  // Actions
  loadCampaigns: (tenantId: string) => Promise<void>;
  loadAnalytics: (campaignIds: string[]) => Promise<void>;
  createCampaign: (tenantId: string, campaignData: any) => Promise<string | null>;
  updateCampaignStatus: (campaignId: string, status: string) => Promise<void>;
  deleteCampaign: (campaignId: string) => Promise<void>;
  recalculateAnalytics: (campaignId: string) => Promise<void>;
  exportMetrics: (campaignId: string) => Promise<void>;
}

export const useMarketingStore = create<MarketingStore>((set, get) => ({
  campaigns: [],
  analytics: {},
  loading: false,
  error: null,

  loadCampaigns: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await (supabase as any)
        .from('marketing_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ campaigns: data || [] });
      
      // Load analytics too
      if (data && data.length > 0) {
        await get().loadAnalytics(data.map((c: any) => c.id));
      }
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  loadAnalytics: async (campaignIds: string[]) => {
    if (campaignIds.length === 0) return;

    try {
      const { data, error } = await (supabase as any)
        .from('campaign_analytics')
        .select('*')
        .in('campaign_id', campaignIds);

      if (error) throw error;

      const analyticsMap: Record<string, CampaignAnalytics> = {};
      data?.forEach((a: any) => {
        analyticsMap[a.campaign_id] = a;
      });

      set({ analytics: analyticsMap });
    } catch (err: any) {
      console.error('Error loading analytics:', err);
    }
  },

  createCampaign: async (tenantId: string, campaignData: any) => {
    try {
      const { data: newCampaign, error } = await (supabase as any)
        .from('marketing_campaigns')
        .insert({
          tenant_id: tenantId,
          ...campaignData,
        })
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        campaigns: [newCampaign, ...state.campaigns],
      }));

      return newCampaign.id;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  updateCampaignStatus: async (campaignId: string, status: string) => {
    try {
      const { error } = await (supabase as any)
        .from('marketing_campaigns')
        .update({ status })
        .eq('id', campaignId);

      if (error) throw error;

      set((state) => ({
        campaigns: state.campaigns.map((c) =>
          c.id === campaignId ? { ...c, status: status as any } : c
        ),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteCampaign: async (campaignId: string) => {
    try {
      // Delete cascade
      await (supabase as any).from('campaign_messages').delete().eq('campaign_id', campaignId);
      await (supabase as any).from('campaign_contacts').delete().eq('campaign_id', campaignId);
      await (supabase as any)
        .from('campaign_analytics')
        .delete()
        .eq('campaign_id', campaignId);
      
      const { error } = await (supabase as any)
        .from('marketing_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      set((state) => ({
        campaigns: state.campaigns.filter((c) => c.id !== campaignId),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  recalculateAnalytics: async (campaignId: string) => {
    try {
      const { data, error } = await (supabase as any).rpc('recalculate_campaign_analytics', {
        p_campaign_id: campaignId,
      });

      if (error) throw error;

      if (data && data[0]?.success) {
        const analytics = data[0].analytics;
        set((state) => ({
          analytics: {
            ...state.analytics,
            [campaignId]: analytics,
          },
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  exportMetrics: async (campaignId: string) => {
    const campaign = get().campaigns.find((c) => c.id === campaignId);
    const analytics = get().analytics[campaignId];

    if (!campaign || !analytics) {
      set({ error: 'Campaign or analytics not found' });
      return;
    }

    // Create CSV
    const csv = [
      ['Métrica', 'Valor'],
      ['Nome da Campanha', campaign.name],
      ['Status', campaign.status],
      ['---', '---'],
      ['Total Contatos', campaign.total_contacts],
      ['Enviadas', analytics.total_sent],
      ['Entregues', analytics.total_delivered],
      ['Lidas', analytics.total_read],
      ['Falhadas', campaign.failed_count],
      ['---', '---'],
      ['Taxa Entrega', `${analytics.delivery_rate.toFixed(2)}%`],
      ['Taxa Leitura', `${analytics.read_rate.toFixed(2)}%`],
      ['Taxa Click', `${analytics.click_rate.toFixed(2)}%`],
      ['Taxa Conversão', `${analytics.conversion_rate.toFixed(2)}%`],
      ['---', '---'],
      ['Pedidos Gerados', analytics.orders_generated],
      ['Receita', `R$ ${analytics.revenue_generated.toFixed(2)}`],
      ['Data Criação', new Date(campaign.created_at).toLocaleDateString('pt-BR')],
    ]
      .map((row) => row.join(','))
      .join('\n');

    // Download
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
    element.setAttribute('download', `campanha-${campaign.id}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  },
}));
