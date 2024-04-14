//we will get csv file by url
//compare the data with the data from previous call
//return raws that are different, if it is absent in previous call, return it with 0 stock
const express = require("express");
const axios = require("axios");
// const csv = require('csv-parser');
// const fs = require('fs');
const app = express();
const port = 3000;

let previousData = []; //array of rows from csv file
let diff = []; //array of rows that are different from previous call

app.get("/", (req, res) => {
	let [headers, rows] = previousData;
	res.send(`hi i have ${rows?.length} rows with ${headers?.length} columns`);
});
///getFile?url=https://onninen.pl/feed/csv?token=8e8a70c1-025f-49a3-8061-77f0e86637e8&scope=1
app.get("/getFile", async (req, res) => {
	console.log("file loading started");
	const url = req.query.url;
	if (!url) {
		res.status(400).send("url is required");
		return;
	}
	const newData = await getNewData(url);
   // diff = await generateDiff(previousData, newData);
    diff = newData[1][45];
	previousData = newData;
	res.send(`got new data, for update only ${diff.length} rows are different`);
});

function generateDiff(previousData, newData) {
    const [headers, rows] = newData;
    const [prevHeaders, prevRows] = previousData;
    const diff = [];
    const prevData = prevRows.reduce((acc, row) => {
        const [id, stock] = row.split(',');
        acc[id] = parseInt(stock);
        return acc;
    }, {});
    rows.forEach(row => {
        const [id, stock] = row.split(',');
        if (prevData[id] !== parseInt(stock)) {
            diff.push(row);
        }
    });
    return diff;
}

app.get("/getDiff", (req, res) => {//return csv with only different raws from previous call
    //send diff as csv
    const [headers] = previousData;
    const csv = `${headers.join(',')}\n${diff.join('\n')}`
    
    res.attachment('customers.csv').send(csv)

});

function getNewData(url) {
	return new Promise((resolve, reject) => {
		axios
			.get(url)
			.then((response) => {
				const csvData = response.data;
				const lines = csvData.split("\n");
				const headers = lines.shift().split(",");
				// lines.forEach(line => {
				//     const [id, stock] = line.split(',');
				//     data[id] = parseInt(stock);
				// });
				resolve([headers, lines]);
			})
			.catch((error) => {
				reject(error);
			});
	});
}



app.listen(port, () => {
	console.log(`Server started on port ${port}`);
});
