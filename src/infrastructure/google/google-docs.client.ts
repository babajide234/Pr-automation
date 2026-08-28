import { google } from "googleapis";
import { GOOGLE_SCOPES } from "../../config/constants";
import { ConfigurationError } from "../../domain/errors";

export interface GoogleDocsClientOptions {
    credentials: string;
    documentId: string;
}

export class GoogleDocsClient {
    constructor(private readonly options: GoogleDocsClientOptions) {}

    async append(content: string): Promise<void> {
        let credentials: Record<string, unknown>;
        try {
            credentials = JSON.parse(this.options.credentials) as Record<string, unknown>;
        } catch {
            throw new ConfigurationError(
                "GOOGLE_SERVICE_ACCOUNT is not valid JSON.",
            );
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: GOOGLE_SCOPES,
        });
        const docs = google.docs({ version: "v1", auth });

        await docs.documents.batchUpdate({
            documentId: this.options.documentId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: { index: 1 },
                            text: content,
                        },
                    },
                ],
            },
        });
    }
}
