const fs = require("fs");
const path = require("path");

const handler = (res) => {
  fs.readFile(
    path.resolve("./handlers/oauth/login.html"),
    function read(err, data) {
      if (err) {
        console.log(err);
        res.json({
          error: "No response",
        });
      }
      res.writeHeader(200, { "Content-Type": "text/html" });
      res.write(data);
      res.end();
    }
  );
};

module.exports = (cors) => (req, res) => {
  cors(req, res, async () => {
    if (req.method === "GET") {
      return handler(res);
    }
    res.status(405).send("method not allowed");
  });
};
