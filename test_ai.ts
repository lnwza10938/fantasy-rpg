import 'dotenv/config';
import { WorldGenerator } from './src/core/worldGenerator.js';

async function test() {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    console.log('Testing with API Key:', process.env.GEMINI_API_KEY.substring(0, 5) + '...');

    const wg = new WorldGenerator();
    try {
        const result = await wg.generate('skill', '123456789');
        console.log('Success:', result);
    } catch (e) {
        console.error('Failed:', e);
    }
}

test();
