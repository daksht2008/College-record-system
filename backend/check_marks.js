const db = require('./db');
async function check() {
    try {
        const [marks] = await db.execute("SELECT * FROM marks");
        console.log("Total marks records:", marks.length);
        console.log(marks);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
