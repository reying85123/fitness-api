const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const envData = require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});
const cors = require("cors");

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const goalRouter = require("./routes/goal");
const trainingLogRouter = require("./routes/training-log");
const scheduleRouter = require("./routes/schedule");

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const corsOptions = {
  origin: ["http://localhost:8080"],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/goal", goalRouter);
app.use("/training-log", trainingLogRouter);
app.use("/schedule", scheduleRouter);

module.exports = app;
