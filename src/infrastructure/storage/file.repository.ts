import fs from "fs";
import { PRDocumentation } from "../../domain/models/pr-documentation";

export class FileRepository {
    save(data: PRDocumentation, outputDir = "."): string {
        const filePath = `${outputDir}/pr-${data.prNumber}.json`;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return filePath;
    }
}
