const db = require('./db');

async function clearAll() {
    try {
        await db.execute('DELETE FROM marks');
        await db.execute('DELETE FROM attendance');
        await db.execute('DELETE FROM students');
        console.log("All student data, marks, and attendance cleared!");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}

clearAll();
