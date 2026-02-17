import { parseSMS } from './src/services/smsParser';

const testMessages = [
    {
        sender: 'HDFCBANK',
        body: 'Rs.500.00 spent on card x1234 at MERCHANT on 17-Feb-26. Avl bal: Rs.10000.00',
        expectedBank: 'HDFC',
        expectedAmount: 500,
    },
    {
        sender: 'ICICIB',
        body: 'ICICI Bank Acct XX1234 debited for Rs 1,000.00 on 17-Feb-26. Info: UPI/1234567890/MERCHANT. Avl Bal: INR 5,000.00',
        expectedBank: 'ICICI',
        expectedAmount: 1000,
    },
    {
        sender: 'SBI',
        body: 'SBI: Rs 200.00 debited by SBI Debit Card 5678. Ref: 1234567890. Avl Bal: Rs 1500.00',
        expectedBank: 'SBI',
        expectedAmount: 200,
    },
    {
        sender: 'CANARA',
        body: 'Rs. 50.00 paid thru A/C XX1234 to MERCHANT-Canara. UPI Ref 1234567890. Avl bal INR 100.00',
        expectedBank: 'CANARA',
        expectedAmount: 50,
    }
];

function runTests() {
    let passed = 0;
    testMessages.forEach((test, index) => {
        const result = parseSMS(test.sender, test.body);
        if (result && result.bank === test.expectedBank && result.amount === test.expectedAmount) {
            console.log(`Test ${index + 1} passed!`);
            passed++;
        } else {
            console.log(`Test ${index + 1} failed!`);
            console.log('Expected:', { bank: test.expectedBank, amount: test.expectedAmount });
            console.log('Result:', result ? { bank: result.bank, amount: result.amount } : 'null');
        }
    });
    console.log(`\nTests passed: ${passed}/${testMessages.length}`);
}

runTests();
