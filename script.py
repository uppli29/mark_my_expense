import json
import csv
from datetime import datetime
import argparse

def replace_category(category:str) -> str:
    if category.lower() == 'grooming':
        return 'Personal Care'
    elif category.lower() == 'misc':
        return 'Others'
    elif category.lower() == 'household':
        return 'Family'
    elif category.lower() == 'bills':
        return 'Bills & Utilities'
    elif category.lower()  == 'dinning':
        return 'Food & Dinning'
    elif category.lower() == 'emi':
        return 'EMI & Loans'
    else:
        return category

def parse_expenses_to_csv(input_json_file, output_csv_file):
    """
    Parse JSON expense data and export to CSV.
    
    Args:
        input_json_file: Path to input JSON file
        output_csv_file: Path to output CSV file
    """
    # Read JSON file
    with open(input_json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Filter and process EXPENSE entries
    expenses = []
    for entry in data:
        if entry.get('type') == 'EXPENSE':
            # Parse date from "2025-01-01 14:01:15" to "01-01-2025"
            date_str = entry.get('date', '')
            try:
                parsed_date = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
                formatted_date = parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                formatted_date = ''
            
            # Extract required fields
            expenses.append({
                'Account': entry.get('bankname', ''),
                'Category': replace_category(entry.get('category', '')),
                'Amount': entry.get('amount', ''),
                'Date': formatted_date,
                'Description': entry.get('description', '')
            })
    
    # Write to CSV
    if expenses:
        with open(output_csv_file, 'w', newline='', encoding='utf-8') as f:
            # Headers as specified: Bank, Category, Amount, Date, Description
            fieldnames = ['Account', 'Category', 'Amount', 'Date', 'Description']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            writer.writeheader()
            writer.writerows(expenses)
        
        print(f"Successfully exported {len(expenses)} expenses to {output_csv_file}")
    else:
        print("No EXPENSE entries found in the JSON file")

# Usage
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Parse JSON expense data and export to CSV.')
    parser.add_argument('input_file', type=str, help='Path to input JSON file')
    parser.add_argument('output_file', type=str, help='Path to output CSV file')
    args = parser.parse_args()
    input_file = args.input_file
    output_file = args.output_file
    parse_expenses_to_csv(input_file, output_file)