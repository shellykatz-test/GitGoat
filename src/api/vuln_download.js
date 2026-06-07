const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
app.get("/download", (req, res) => {
  const filePath = path.join("./public", req.query.file);
  const data = fs.readFileSync(filePath);
  res.send(data);
});

app.get("/download2", (req, res) => {
  const filePath = path.join("./public", req.query.filename);
  res.send(fs.readFileSync(filePath));
});

module.exports = app;  
