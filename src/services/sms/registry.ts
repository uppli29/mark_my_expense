import { IBankParser } from './base';
import { HDFCParser } from './parsers/hdfc';
import { ICICIParser } from './parsers/icici';
import { SBIParser } from './parsers/sbi';
import { CanaraParser } from './parsers/canara';
import { IOBParser } from './parsers/iob';
import { IndianBankParser } from './parsers/indianBank';

export const ParserRegistry: IBankParser[] = [
    new HDFCParser(),
    new ICICIParser(),
    new SBIParser(),
    new CanaraParser(),
    new IOBParser(),
    new IndianBankParser(),
];

export function findParser(sender: string): IBankParser | undefined {
    return ParserRegistry.find(parser => parser.identify(sender));
}
