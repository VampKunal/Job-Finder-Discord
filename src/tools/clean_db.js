import "dotenv/config";
import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) {
  console.error("Missing MONGODB_URI in environment.");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);

async function cleanMongo() {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "job_bot");
  const col = db.collection("seen_jobs");

  const totalBefore = await col.countDocuments();
  console.log(`Total seen_jobs in MongoDB before clean: ${totalBefore}`);

  const deleteResult = await col.deleteMany({
    $or: [
      { key: { $regex: "interndoor", $options: "i" } },
      { key: { $regex: "gh-", $options: "i" } },
      { key: { $regex: "github", $options: "i" } },
    ]
  });

  console.log(`Deleted ${deleteResult.deletedCount} interndoor/github records.`);

  const totalAfter = await col.countDocuments();
  console.log(`Remaining seen_jobs count: ${totalAfter}`);

  await client.close();
}

cleanMongo().catch(err => {
  console.error("Error cleaning MongoDB:", err);
  process.exit(1);
});
