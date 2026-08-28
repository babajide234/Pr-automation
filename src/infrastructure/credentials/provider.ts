export type CredentialName = "github_token" | "google_service_account";

export interface CredentialProvider {
    resolve(name: CredentialName): string | undefined;
}
