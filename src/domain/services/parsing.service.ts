export class ParsingService {
    hasHeading(body: string, heading: string): boolean {
        const escaped = escapeRegExp(heading);
        return new RegExp(`^${escaped}\\s*$`, "m").test(body);
    }

    extractSection(body: string, heading: string): string {
        const escaped = escapeRegExp(heading);
        const regex = new RegExp(`${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
        const match = body.match(regex);
        return match ? match[1].trim() : "";
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
