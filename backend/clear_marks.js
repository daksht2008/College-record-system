const db = require('./db');

async function clearMarks() {
    try {
        await db.execute('DELETE FROM marks');
        console.log("Marks cleared successfully!");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}

clearMarks();
