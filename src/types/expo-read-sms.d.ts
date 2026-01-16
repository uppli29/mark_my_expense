declare module '@maniac-tech/react-native-expo-read-sms' {
    export interface SMSPermissionResult {
        hasReceiveSmsPermission: boolean;
        hasReadSmsPermission: boolean;
    }

    export function checkIfHasSMSPermission(): Promise<SMSPermissionResult>;
    export function requestReadSMSPermission(): Promise<boolean>;
    export function startReadSMS(
        successCallback: (status: string, sms: string, error: string | null) => void,
        errorCallback: (status: string, sms: string, error: string) => void
    ): void;
}
