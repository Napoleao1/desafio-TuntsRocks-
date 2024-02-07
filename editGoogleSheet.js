const express = require('express')
const { google } = require('googleapis')
const credentials = require("./credentials/key.json")
const app = express() 

// authenticate with googleSheets

async function getAuthSheets() {

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: "https://www.googleapis.com/auth/spreadsheets"
    })

    const client = await auth.getClient(); 
    const googlesheets = google.sheets({
        version: 'v4',
        auth: client
    }) 

    const spreadSheetId = '1JdpysBKcvjVOdQmk63pGsSqPANeCPhLI2EsjddSMPA4' 
    return {
        auth,
        googlesheets,
        client,
        spreadSheetId
    } // supplying the application with the necessary data
}

// The path to retrieve the sheet data
app.get("/metadata", async (req, res) => {
    try {

        const { googlesheets, auth, spreadSheetId } = await getAuthSheets();

        // Call and obtain the sheet's data.
        const metadata = await googlesheets.spreadsheets.get({
            auth,
            spreadsheetId: spreadSheetId
        })

        
        res.status(200).send(metadata);
    } catch (error) {
        res.status(500).send("Error" + error)
    }
})

// Route to get sheet data
app.get("/getSheetData", async (req, res) => {
    try {

        const { googlesheets, auth, spreadSheetId } = await getAuthSheets();

        // Here we obtain information from the spreadsheet.
        // The range is equivalent to the title from the metadata sheets.

        const getRows = await googlesheets.spreadsheets.values.get({
            auth,
            spreadsheetId: spreadSheetId,
            range: "engenharia_de_software",
            valueRenderOption: "UNFORMATTED_VALUE",
            dateTimeRenderOption: "FORMATTED_STRING"
        })

        // Sending back the data of the rows
        res.status(200).send(getRows.data);
    } catch (error) {
        res.status(500).send("Error" + error)
    }
})

// Route to update student statistics
 
app.get('/attStudentsStats', async (req, res) => {
    try {
        const { googlesheets, auth, spreadSheetId } = await getAuthSheets();

        // Get sheet data
        const getRows = await googlesheets.spreadsheets.values.get({
            auth,
            spreadsheetId: spreadSheetId,
            range: "engenharia_de_software",
            valueRenderOption: "UNFORMATTED_VALUE",
            dateTimeRenderOption: "FORMATTED_STRING"
        });

        // Extract the students list
        const students = getRows.data.values.slice(2); // Exclude the first two rows containing non-student related information

        const minimunGrade = 70;
        const finalExam = 50;
        const maximunClasses = 60;
        const absenceRejectionPercentage = 0.25; // 25% of the total number of classes

        function calculateSituation(student) {
            const [, , fouls, p1, p2, p3] = student; //Getting Student data
            const average = (Number(p1) + Number(p2) + Number(p3)) / 3;
        
            if (fouls > maximunClasses * absenceRejectionPercentage) {
                return { situation: "Reprovado por Falta", finalExam: 0 };
            } else if (average >= minimunGrade) {
                return { situation: 'Aprovado', finalExam: 0 };
            } else if (average >= finalExam && average < minimunGrade) {
                return { situation: 'Exame Final', finalExam: calculateNfa(average) };
            } else {
                return{ situation: 'Reprovado por Nota', finalExam: 0 };
            }
        }
        
        function calculateNfa(average) {
            const nfa = Math.max(0, (100 - average)); 
            const roundedNumber = Math.ceil(nfa); // Rounding number 
            return roundedNumber;
        }
        
        //Updating sheets with student statistics

        const studentsUpdated = students.map((student, index) => {
            if (index == 0) {
                return null;
            }
            const { situation, finalExam } = calculateSituation(student);
            return [situation, finalExam]; // Return Array of arrays
        });

        const updatedValues = {
            values: studentsUpdated
        }

        await googlesheets.spreadsheets.values.update({
            spreadsheetId: spreadSheetId,
            range: "engenharia_de_software!G4", // Start from first student
            valueInputOption: "USER_ENTERED",
            resource: updatedValues
        })

        return res.status(200).send(studentsUpdated);
    } catch (error) {
        res.status(500).send("Internal Error");
    }
});

// Starting the api
let port;
app.listen(port = 3001, () => console.log(`o app está rodando ${port}`))