import fs from "fs";

export class FileRepository {
    save(data: any) {
        fs.writeFileSync(
            `./pr-${data.prNumber}.json`,
            JSON.stringify(data, null, 2)
        );
    }
}