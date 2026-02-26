export class ParsingService {
    extractSection(body: string, heading: string): string {
        const regex = new RegExp(`${heading}\\n([\\s\\S]*?)(?=\\n##|$)`);
        const match = body.match(regex);
        return match ? match[1].trim() : "";
    }
}