declare module 'react-native-get-sms-android' {
    export interface SmsFilter {
        /** Filter by inbox type - inbox, sent, draft, outbox, etc */
        box?: 'inbox' | 'sent' | 'draft' | 'outbox' | '';
        /** Filter by read status - 0 for unread, 1 for read */
        read?: 0 | 1;
        /** Filter by body containing text */
        bodyRegex?: string;
        /** Filter by sender address */
        address?: string;
        /** Filter by minimum date (timestamp in ms) */
        minDate?: number;
        /** Filter by maximum date (timestamp in ms) */
        maxDate?: number;
        /** Maximum number of results to return */
        maxCount?: number;
        /** Index position to start from */
        indexFrom?: number;
    }

    export interface SmsMessage {
        _id: string;
        thread_id: string;
        address: string;
        person: string | null;
        date: string;
        date_sent: string;
        protocol: string;
        read: string;
        status: string;
        type: string;
        body: string;
        service_center: string | null;
        locked: string;
        error_code: string;
        sub_id: string;
        seen: string;
        deletable: string;
        sim_slot: string;
        hidden: string;
        app_id: string;
        msg_id: string;
        reserved: string;
        pri: string;
        teleservice_id: string;
        link_url: string | null;
        svc_cmd: string;
        svc_cmd_content: string | null;
        roam_pending: string;
        spam_report: string;
        secret_mode: string;
        safe_message: string;
        favorite: string;
    }

    export default class SmsAndroid {
        static list(
            filter: string,
            failCallback: (error: string) => void,
            successCallback: (count: number, smsList: string) => void
        ): void;
    }
}
