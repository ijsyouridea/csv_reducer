//we will get csv file by url
//compare the data with the data from previous call
//return raws that are different, if it is absent in previous call, return it with 0 stock
const express = require("express");
const axios = require("axios");
const path = require("path");
const { CronJob } = require("cron");
const fs = require("fs");

const app = express();
const port = 3000;
const onninenUrl="https://onninen.pl/feed/csv?token=8e8a70c1-025f-49a3-8061-77f0e86637e8&scope=1"
let lastSync = new Date();
let lastDataGet = new Date(1715619458683);//get from latest file

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
const importantKeys = ["id", "catalogindex", "ean"];
// const updateTriggerKeys = ["price", "stock", "price_catalog"];
const updateTriggerKeys = ["stock"];


app.get("/", function (req, res) {
  res.set("Content-Type", "text/html");
  res.send(
    Buffer.from(`
    <head>
		<meta charset="UTF-8" />
		<title>Sample Site</title>
		<link
			rel="stylesheet"
			href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"
			integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T"
			crossorigin="anonymous"
		/>
		<style>
			body {
				padding-top: 50px;
			}
		</style>
	</head>
	<body>
		<div class="container">
			<div class="jumbotron">
				<p>last time file was downloaded by Woocommerce ${
          lastSync
            ? lastSync.toLocaleString("pl-PL", { timeZone: "Europe/Paris" })
            : "never"
        }</p>
				<p>last time data was syncronised with Onninen ${
          lastDataGet
            ? lastDataGet.toLocaleString("pl-PL", { timeZone: "Europe/Paris" })
            : "never"
        }</p>
			</div>
			link to the file with diffs
			<div id='link'></div>
		</div>
		<script>
			let host = location.origin
			link.innerText = host +'/getDiff'
		</script>
	</body>
	`)
  );
});

app.get("/getFile", async (req, res) => {
  console.log("file loading started");
  const url = req.query.url;
  let diff = [];
  if (!url) {
    res.status(400).send("url is required");
    return;
  }
  try {
    let diffLength = await mainLogic(url);
    res.send(`got new data, for update only ${diffLength} rows are different`);
  } catch (e) {
    res.json(e);
  }
});

app.get("/getDiff", (req, res) => {
	//return csv with only different raws from previous call
	//send diff as csv
	fs.readFile("diff.csv", "utf8", (err, csv) => {
	  if (err) {
		console.error(err);
		return;
	  }
	  // const csv = data.split("\n");
	  // previousData = [csv[0].split(";"), csv.slice(1)];
	  lastSync = new Date();
	  res.attachment("data.csv").send(csv);
	});
  });

async function mainLogic(url){
	const newData = await getNewData(url);
    lastDataGet = new Date(); //update
    console.log("comparing started");
    diff = generateDiff(previousData, newData);

    if (lastSync !== null) {
      // it means nobody has requested the file yet
      // and we need tp merge the files
      previousData = newData;
      // save new data to file
      const [headers, rows] = newData;
      const csv = `${headers.join(";")}\n${rows.join("\n")}`;
      fs.writeFileSync("data.csv", csv);

      lastSync = null;
    }

    const diffcsv = `${headers.join(";")}\n${diff.join("\n")}`;
    let now = new Date();
    fs.writeFileSync(`diff${now.getTime()}.csv`, diffcsv);
    fs.writeFileSync(`diff.csv`, diffcsv);

	return diff.length
}

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
      if (parseFloat(row[5]) >= 30) {
        diff.push(row.join(";"));
      }
    } else {
      const oldRow = prevRows[oldRowIndex];
      let isDifferent = prevUpdateIndexes.some(
        (key, i) => row[newUpdateIndexes[i]] !== oldRow[key]
      );
      if (isDifferent && parseFloat(row[5]) >= 30) {
        //console.log({ old:oldRow[5], new:row[5] });
        diff.push(row.join(";"));
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
        row.join(";");
      })
    );
  }

  return diff;
}

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

new CronJob(
  "0 9 * * *", // cronTime
  function () {
    mainLogic(onninenUrl).then((diffLength) => {
		console.log(`got new data, for update only ${diffLength} rows are different`);
	});
  }, // onTick
  null, // onComplete
  true, // start
  "Europe/Paris" // timeZone
);

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
