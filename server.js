import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();

// Configuración de CORS explícita para Netlify
app.use(cors({
    origin: '*',
    methods: ['GET']
}));

// Conexión a Supabase con configuración de fetch global
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: { fetch: fetch } 
});

// ==========================================
// API ENDPOINT (CON BYPASS DE LÍMITE)
// ==========================================
app.get('/api/candles', async (req, res) => {
    const { symbol, limit = 30000 } = req.query; // 30k es ideal para no saturar el 4G

    if (!symbol) return res.status(400).json({ error: "Falta el symbol" });

    try {
        console.log(`[API] Solicitando data extendida para ${symbol}...`);
        
        let allData = [];
        let offset = 0;
        const targetLimit = parseInt(limit);

        // BUCLE QUIRÚRGICO: Pedimos de a 1000 hasta completar lo que pidió el frontend
        while (allData.length < targetLimit) {
            const { data, error } = await supabase
                .from('candles')
                .select('open, high, low, close')
                .eq('symbol', symbol)
                .order('timestamp', { ascending: false })
                .range(offset, offset + 999); // Trae bloques de 1000

            if (error) throw error;
            if (!data || data.length === 0) break;

            allData = allData.concat(data);
            
            // Si el bloque vino incompleto, no hay más datos en la base
            if (data.length < 1000) break;

            offset += 1000;
        }

        // Formatear para el motor k-NN (Array ordenado cronológicamente)
        const formatted = allData.map(c => ({
            o: c.open,
            h: c.high,
            l: c.low,
            c: c.close
        })).reverse();

        console.log(`[API SUCCESS] ${formatted.length} velas enviadas de ${symbol}`);
        res.json(formatted);
    } catch (error) {
        console.error(`[API ERROR] ${symbol}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// PUERTO DINÁMICO: Crucial para que Render acepte la conexión
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API Quant Backend activa en puerto ${PORT}`);
});
