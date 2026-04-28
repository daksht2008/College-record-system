const fs = require('fs');
const pdfParse = require('pdf-parse');
async function test() {
    try {
        const files = fs.readdirSync('./uploads/2025-26');
        for (let file of files) {
            if (file.endsWith('.pdf')) {
                const dataBuffer = fs.readFileSync('./uploads/2025-26/' + file);
                const pdfData = await pdfParse(dataBuffer);
                const text = pdfData.text;
                const lines = text.split('\n');
                let found = false;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('095') || lines[i].includes('AB') || lines[i].includes('14.5') || lines[i].includes('KRRISH')) {
                        console.log(`LINE ${i}:`, lines[i]);
                    }
                }
                break; // Just one file
            }
        }
    } catch(e) { console.error(e); }
    process.exit(0);
}
test();
