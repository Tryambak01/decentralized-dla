import express from "express";
import userRouter from "./routers/user";
import workerRouter from "./routers/worker";
import cors from "cors";
import * as dotenv from 'dotenv';
dotenv.config();

const app = express();

app.use(express.json());                                                                    //allows users to send data into the body
app.use(cors());

app.use("/v1/user", userRouter);
app.use("/v1/worker", workerRouter);

app.listen(3000, () => {
    console.log("Server running on port 3000");
});