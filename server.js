import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());

// Conexión a Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// API ENDPOINT (SOLO LECTURA)
// ==========================================
app.get('/api/candles', async (req, res) => {
    // Aceptamos el limit gigante que pide el frontend
    const { symbol, interval = '5m', limit = 50000 } = req.query;

    if (!symbol) return res.status(400).json({ error: "Falta el symbol" });

    try {
        console.log(`[API] Sirviendo ${limit} velas de ${symbol} al escáner...`);
        
        // Traer datos directo de la base de datos (Ultra rápido, sin sync)
        const { data, error } = await supabase
            .from('candles')
            .select('open, high, low, close, timestamp')
            .eq('symbol', symbol)
            .eq('interval', interval)
            .order('timestamp', { ascending: false })
            .limit(parseInt(limit));

        if (error) {
            console.error(`[SUPABASE ERROR] ${symbol}:`, error.message);
            throw error;
        }

        if (!data || data.length === 0) {
            console.log(`[API WARN] No se encontraron velas para ${symbol} en la base de datos.`);
            return res.json([]); // Devuelve array vacío en lugar de error si no hay datos
        }

        // Formatear para el frontend (el HTML espera array ordenado cronológicamente)
        // Mapear un array grande puede ser costoso, pero Node lo maneja bien
        const formatted = data.map(c => ({
            o: c.open,
            h: c.high,
            l: c.low,
            c: c.close
        })).reverse();

        console.log(`[API SUCCESS] ${formatted.length} velas enviadas para ${symbol}`);
        res.json(formatted);
    } catch (error) {
        console.error(`[API ERROR] Error general en ${symbol}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`⚡ API Quant Backend corriendo en http://localhost:${PORT}`);
    console.log(`📡 Esperando peticiones del escáner HTML...`);
});