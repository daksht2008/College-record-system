const pdfParse = require('pdf-parse');
const fs = require('fs');

async function test() {
    try {
        const dataBuffer = fs.readFileSync('./uploads/1777281889054.pdf');
        const pdfData = await pdfParse(dataBuffer);
        fs.writeFileSync('./pdf_text_output.txt', pdfData.text);
        console.log("Extracted to pdf_text_output.txt");
    } catch (e) {
        console.error(e);
    }
}
test();
