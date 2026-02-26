import { google } from "googleapis";
import { env, GOOGLE_SCOPES } from "../../config";

export class GoogleDocsClient {
    async append(content: string) {
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(env.GOOGLE_SERVICE_ACCOUNT),
            scopes: GOOGLE_SCOPES,
        });

        const docs = google.docs({ version: "v1", auth });

        await docs.documents.batchUpdate({
            documentId: env.GOOGLE_DOC_ID,
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