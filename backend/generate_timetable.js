const db = require('./db');

// Subjects list and their properties
const subjects = [
    { name: 'Maths', color: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', theory: 2, continuousType: 'Tutorial' },
    { name: 'Physics', color: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)', theory: 3, continuousType: 'Lab Practical' },
    { name: 'Basic Electrical Engineering', color: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', theory: 3, continuousType: 'Lab Practical' },
    { name: 'Mechanics', color: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', theory: 3, continuousType: 'Lab Practical' },
    { name: 'Computer Programming', color: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', theory: 3, continuousType: 'Lab Practical' },
    { name: 'Engineering Graphics', color: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', theory: 3, continuousType: 'Lab Practical' }
];

async function generateTimetable(divisionInput) {
    if (!divisionInput || divisionInput.trim() === '') {
        console.error('⚠️ Please provide a division (e.g. Q or R) as a command line argument.');
        console.log('Usage: node generate_timetable.js <division>');
        process.exit(1);
    }

    const division = divisionInput.trim().toUpperCase();
    console.log(`🚀 Generating clash-free college timetable for Division ${division}...`);

    try {
        // 1. Clear any existing timetable for this division
        await db.execute('DELETE FROM schedules WHERE division = ?', [division]);
        console.log(`🧹 Cleared previous timetable entries for Division ${division}.`);

        // 2. Define the continuous 2-hour blocks days & slots mapping
        // Slot coordinates: [day, slotTime1, slotTime2]
        const continuousBlocks = [
            { day: 'Monday', time1: '10:30-11:30', time2: '11:30-12:30' },
            { day: 'Monday', time1: '13:00-14:00', time2: '14:00-15:00' },
            { day: 'Tuesday', time1: '10:30-11:30', time2: '11:30-12:30' },
            { day: 'Wednesday', time1: '10:30-11:30', time2: '11:30-12:30' },
            { day: 'Thursday', time1: '10:30-11:30', time2: '11:30-12:30' },
            { day: 'Friday', time1: '10:30-11:30', time2: '11:30-12:30' }
        ];

        // 3. Define the single 1-hour slots available for Theory lectures
        const theorySlots = [
            { day: 'Monday', time: '15:15-16:15' },
            { day: 'Monday', time: '16:15-17:15' },
            { day: 'Tuesday', time: '13:00-14:00' },
            { day: 'Tuesday', time: '14:00-15:00' },
            { day: 'Tuesday', time: '15:15-16:15' },
            { day: 'Tuesday', time: '16:15-17:15' },
            { day: 'Wednesday', time: '13:00-14:00' },
            { day: 'Wednesday', time: '14:00-15:00' },
            { day: 'Wednesday', time: '15:15-16:15' },
            { day: 'Wednesday', time: '16:15-17:15' },
            { day: 'Thursday', time: '13:00-14:00' },
            { day: 'Thursday', time: '14:00-15:00' },
            { day: 'Thursday', time: '15:15-16:15' },
            { day: 'Thursday', time: '16:15-17:15' },
            { day: 'Friday', time: '13:00-14:00' },
            { day: 'Friday', time: '14:00-15:00' },
            { day: 'Friday', time: '15:15-16:15' },
            { day: 'Friday', time: '16:15-17:15' }
        ];

        // 4. Calculate division rotation shift to make divisions fully clash-free
        const shift = (division.charCodeAt(0) - 65) % subjects.length;

        // 5. Place the continuous 2-hour sessions (Tutorial / Lab Practical)
        for (let i = 0; i < subjects.length; i++) {
            const subjIndex = (i + shift) % subjects.length;
            const subject = subjects[subjIndex];
            const block = continuousBlocks[i];

            // Insert first continuous hour
            await db.execute(
                'INSERT INTO schedules (day, time_slot, subject, type, division, color) VALUES (?, ?, ?, ?, ?, ?)',
                [block.day, block.time1, subject.name, subject.continuousType, division, subject.color]
            );
            // Insert second continuous hour
            await db.execute(
                'INSERT INTO schedules (day, time_slot, subject, type, division, color) VALUES (?, ?, ?, ?, ?, ?)',
                [block.day, block.time2, subject.name, subject.continuousType, division, subject.color]
            );
            console.log(`✅ Scheduled continuous 2-hour "${subject.continuousType}" for "${subject.name}" on ${block.day}.`);
        }

        // 6. Build the Theory Sessions queue
        const theoryQueue = [];
        for (let i = 0; i < subjects.length; i++) {
            const subjIndex = (i + shift) % subjects.length;
            const subject = subjects[subjIndex];
            for (let t = 0; t < subject.theory; t++) {
                theoryQueue.push(subject);
            }
        }

        // 7. Place the Theory Lectures in the single slots
        for (let i = 0; i < theoryQueue.length; i++) {
            const subject = theoryQueue[i];
            const slot = theorySlots[i];

            await db.execute(
                'INSERT INTO schedules (day, time_slot, subject, type, division, color) VALUES (?, ?, ?, ?, ?, ?)',
                [slot.day, slot.time, subject.name, 'Theory', division, subject.color]
            );
        }
        
        console.log(`✅ Scheduled all ${theoryQueue.length} Theory lectures in the single slots.`);
        console.log(`🎉 Timetable for Division ${division} is successfully created!`);
        console.log(`📈 Packed: 29 hours scheduled, 1 hour break/empty slot left.`);
        process.exit(0);
    } catch(err) {
        console.error('❌ Error generating college timetable:', err.message);
        process.exit(1);
    }
}

// Read CLI argument
const args = process.argv.slice(2);
generateTimetable(args[0]);
