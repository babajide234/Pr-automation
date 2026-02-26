import dotenv from "dotenv";
import { PRDocWorkflow } from "./application/pr-doc.workflow";

dotenv.config();

async function main() {
    const workflow = new PRDocWorkflow();
    await workflow.execute();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});