const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// ให้ Express สามารถแกะอ่านข้อมูลแบบ JSON จากหน้าบ้านได้
app.use(express.json());

// บอกให้เซิร์ฟเวอร์รู้ว่าไฟล์หน้าบ้าน (HTML/CSS) จะอยู่ในโฟลเดอร์ชื่อ public
app.use(express.static(path.join(__dirname, 'public')));

// เมื่อเปิดหน้าแรก (/) จะทำการดึงไฟล์ index.html ขึ้นมาส่งให้ผู้ใช้งาน
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// เส้นทางสำหรับตรวจคะแนน/คำตอบที่หน้าบ้านพูดส่งเข้ามา
app.post('/check-answer', (req, res) => {
    const { userAnswer } = req.body;
    const correctAnswer = "cat"; // กำหนดคำตอบที่ถูกต้องที่ต้องการตรวจ (เช่น แมว)

    // ตรวจคำตอบ หากตรงกันเป๊ะให้ส่งสถานะถูกกลับไป
    if (userAnswer === correctAnswer) {
        res.json({ isCorrect: true });
    } else {
        res.json({ isCorrect: false });
    }
});

// Proxy เส้นทางรูปภาพจาก Google Drive เพื่อแก้ปัญหาเบราว์เซอร์บล็อครูปภาพ (CORS / Third-party cookies)
app.get('/proxy-image', async (req, res) => {
    const fileId = req.query.id;
    if (!fileId) {
        return res.status(400).send('Missing file id');
    }
    try {
        const response = await fetch(`https://lh3.googleusercontent.com/d/${fileId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch from Google Drive: ${response.statusText}`);
        }
        const contentType = response.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        // Cache the images for 1 year so they load instantly after the first fetch
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
    } catch (error) {
        console.error('Proxy image error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ===== ระบบจัดการคำศัพท์ที่ผู้ใช้แจ้งเพิ่ม (Word Suggestion APIs) =====
const fs = require('fs');
const SUGGESTIONS_FILE = path.join(__dirname, 'data', 'word_suggestions.json');

function getSuggestions() {
    try {
        if (!fs.existsSync(SUGGESTIONS_FILE)) {
            const dir = path.dirname(SUGGESTIONS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(SUGGESTIONS_FILE, '[]', 'utf-8');
            return [];
        }
        const data = fs.readFileSync(SUGGESTIONS_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (e) {
        console.error('Error reading suggestions:', e);
        return [];
    }
}

function saveSuggestions(list) {
    try {
        const dir = path.dirname(SUGGESTIONS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
        console.error('Error saving suggestions:', e);
    }
}

// เส้นทางบันทึกคำศัพท์แจ้งเพิ่ม (POST)
app.post('/api/suggest-word', (req, res) => {
    const { kanji, reading, lesson, meaning, note } = req.body;
    if (!kanji || !reading || !lesson) {
        return res.status(400).json({ error: 'กรุณากรอกคันจิ คำอ่าน และบทที่ต้องการแจ้งให้ครบถ้วน' });
    }
    const suggestions = getSuggestions();
    const newEntry = {
        id: 'sug_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        kanji: kanji.trim(),
        reading: reading.trim(),
        lesson: parseInt(lesson, 10) || lesson,
        meaning: (meaning || '').trim(),
        note: (note || '').trim(),
        createdAt: new Date().toISOString(),
        status: 'pending'
    };
    suggestions.unshift(newEntry);
    saveSuggestions(suggestions);
    res.json({ success: true, item: newEntry });
});

// เส้นทางดึงรายการคำศัพท์ที่แจ้งเพิ่มทั้งหมด (GET)
app.get('/api/suggest-words', (req, res) => {
    const list = getSuggestions();
    res.json(list);
});

// เส้นทางลบรายการคำศัพท์ที่แจ้งเพิ่ม (DELETE)
app.delete('/api/suggest-word/:id', (req, res) => {
    const { id } = req.params;
    let list = getSuggestions();
    list = list.filter(item => item.id !== id);
    saveSuggestions(list);
    res.json({ success: true });
});

// สั่งให้ Server ทำงานและเปิดช่องทางการรับส่งข้อมูลที่พอร์ต 3000
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});