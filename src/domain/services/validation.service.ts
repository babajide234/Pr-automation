export class ValidationService {
    validate(body: string) {
        const required = [
            "## Summary",
            "## Technical Design",
            "## Rollback Plan"
        ];

        for (const section of required) {
            if (!body.includes(section)) {
                throw new Error(`Missing required section: ${section}`);
            }
        }

        if (body.includes("TBD")) {
            throw new Error("Placeholder text found.");
        }
    }
}