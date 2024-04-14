//we will get csv file by url
//compare the data with the data from previous call
//return raws that are different, if it is absent in previous call, return it with 0 stock
const express = require('express');
const axios = require('axios');
// const csv = require('csv-parser');
// const fs = require('fs');
const app = express();
const port = 3000;

let previousData = [];//array of rows from csv file

app.get('/', (req, res) => {
    res.send(`hi i have ${previousData.length} rows`);
});

app.get('/getFile', async (req, res) => {
    console.log('file loading started')
    const url = req.query.url;
    if (!url) {
        res.status(400).send('url is required');
        return;
    }
    const newData = await getNewData(url);
    // const diff = compareData(newData, previousData);
    previousData = newData;
    res.send('got new data');
});

function getNewData(url) {
    return new Promise((resolve, reject) => {
        axios.get(url)
            .then(response => {
                const csvData = response.data;
                const lines = csvData.split('\n');
                const headers = lines.shift().split(',');
                // lines.forEach(line => {
                //     const [id, stock] = line.split(',');
                //     data[id] = parseInt(stock);
                // });
                resolve([headers, lines]);
            })
            .catch(error => {
                reject(error);
            });
    });
}

function compareData(newData, oldData) {
    const diff = {};
    for (const id in newData) {
        if (newData[id] !== oldData[id]) {
            diff[id] = newData[id];
        }
    }
    return diff;
}

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})