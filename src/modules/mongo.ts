import * as mongodb from "mongodb";
import { Log } from "./utils";

const MongoClient: mongodb.MongoClient = new mongodb.MongoClient(process.env.MONGO_CONNECTION_STRING || "");
const Database: mongodb.Db = MongoClient.db(process.env.MONGO_DATABASE_NAME || "");

MongoClient.connect().then(() => {
  Log(`Connected to MongoDB`);
})

export {
  MongoClient,
  Database,
}
