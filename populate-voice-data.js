const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'public', 'js', 'data');
const files = ['one.js', 'two.js', 'three.js', 'four.js', 'five.js', 'six.js'];

console.log('🌸 Starting to populate missing japaneseText fields...');

files.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ File not found: ${file}, skipping.`);
        return;
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const dataName = file.replace('.js', 'Data'); // e.g., fiveData

    try {
        // Compile the JavaScript file in a context to extract the data object
        const sandboxFunction = new Function(`
            ${fileContent}
            return ${dataName};
        `);
        const dataObj = sandboxFunction();

        if (!dataObj || !dataObj.questions) {
            console.log(`❌ Failed to parse data structure from ${file}`);
            return;
        }

        let updatedCount = 0;
        dataObj.questions.forEach(q => {
            if (q.choices && q.correct !== undefined && q.correct >= 0 && q.correct < q.choices.length) {
                const correctChoice = q.choices[q.correct];
                // Only update if it is empty
                if (!q.japaneseText) {
                    q.japaneseText = correctChoice;
                    updatedCount++;
                }
            }
        });

        if (updatedCount > 0) {
            // Serialize back to file matching the original format
            const formattedContent = `const ${dataName} = ${JSON.stringify(dataObj, null, 4)};\n`;
            fs.writeFileSync(filePath, formattedContent, 'utf8');
            console.log(`✅ Updated ${file}: populated ${updatedCount} empty japaneseText field(s).`);
        } else {
            console.log(`ℹ️ ${file}: No changes needed (all fields already populated).`);
        }

    } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
    }
});

console.log('🌸 Done!');
