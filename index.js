//we will get csv file by url
//compare the data with the data from previous call
//return raws that are different, if it is absent in previous call, return it with 0 stock
const express = require("express");
const axios = require("axios");
// const csv = require('csv-parser');
const fs = require("fs");
const app = express();
const port = 3000;

//get data from csv file
let previousData = [[], []];
fs.readFile("data.csv", "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  const csv = data.split("\n");
  previousData = [csv[0].split(";"), csv.slice(1)];
  console.log("data loaded from file");
});
let diff = []; //array of rows that are different from previous call
const importantKeys = ["id", "catalogindex", "ean"];
const updateTriggerKeys = ["price", "stock", "price_catalog"];

app.get("/", (req, res) => {
  let [headers, rows] = previousData;
  res.send(`hi i have ${diff?.length} rows with ${headers?.length} columns`);
});
///getFile?url=https://onninen.pl/feed/csv?token=8e8a70c1-025f-49a3-8061-77f0e86637e8&scope=1
app.get("/getFile", async (req, res) => {
  console.log("file loading started");
  const url = req.query.url;
  if (!url) {
    res.status(400).send("url is required");
    return;
  }
  try {
    const newData = await getNewData(url);
    console.log("comparing started");
    diff = generateDiff(previousData, newData);
    // diff = newData[1][45];
    previousData = newData;
    //save new data to file
    const [headers, rows] = newData;
    const csv = `${headers.join(",")}\n${rows.join("\n")}`;
    fs.writeFileSync("data.csv", csv);

    res.send(`got new data, for update only ${diff.length} rows are different`);
  } catch (e) {
    res.json(e);
  }
});

function generateDiff(previousData, newData) {
  let [headers, rows] = newData;
  let [prevHeaders, prevRows] = previousData;
  rows = rows.map((row) => row.split(";"));
  prevRows = prevRows.map((row) => row.split(";"));
  const diff = [];
  const newHeaderIndexes = importantKeys.map((key) => headers.indexOf(key));
  const prevHeaderIndexes = importantKeys.map((key) =>
    prevHeaders.indexOf(key)
  );
  const newUpdateIndexes = updateTriggerKeys.map((key) => headers.indexOf(key));
  const prevUpdateIndexes = updateTriggerKeys.map((key) =>
    prevHeaders.indexOf(key)
  );
  rows.forEach((row) => {
    let oldRowIndex = prevRows.findIndex((prevRow) =>
      prevHeaderIndexes.every(
        (index, i) => prevRow[index] === row[newHeaderIndexes[i]]
      )
    );
    if (oldRowIndex === -1) {
      diff.push(row.join(","));
    } else {
      const oldRow = prevRows[oldRowIndex];
      let isDifferent = prevUpdateIndexes.some(
        (key, i) => row[newUpdateIndexes[i]] !== oldRow[key]
      );
      if (isDifferent) {
        console.log({ oldRow, row });
        diff.push(row.join(","));
      }
      prevRows.splice(oldRowIndex, 1);
    }
  });
  if (prevRows.length) {
    console.log(`deleted rows, 0 stock ${prevRows.length}`);
    //if there are rows that are absent in new data
    diff.push(
      ...prevRows.map((row) => {
        row[prevUpdateIndexes[1]] = 0; //set stock to 0
        row.join(",");
      })
    );
  }

  return diff;
}

app.get("/getDiff", (req, res) => {
  //return csv with only different raws from previous call
  //send diff as csv
  const [headers] = previousData;
  const csv = `${headers.join(",")}\n${diff.join("\n")}`;
  let now = new Date();
  fs.writeFileSync(`diff${now.toLocaleString()}.csv`, csv);
  res.attachment("customers.csv").send(csv);
});

function getNewData(url) {
  return new Promise((resolve, reject) => {
    axios
      .get(url)
      .then((response) => {
        const csvData = response.data;
        const lines = csvData.split("\n");
        const headers = lines.shift().split(";");
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
