import requests
import json
import sys
import os
from datetime import datetime

def test_questrade(refresh_token, symbols="AAPL,SHOP.TO"):
    """Test Questrade API with refresh token"""
    print(f"\n{'*'*60}")
    print("Questrade API Test")
    print(f"{'*'*60}")
    print(f"Testing at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Symbols: {symbols}\n")
    
    try:
        # Step 1: exchange refresh token for access token
        print("Step 1: Exchanging refresh token for access token...")
        auth_resp = requests.get(
            "https://login.questrade.com/oauth2/token",
            params={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token
            },
            timeout=10
        )
        
        if auth_resp.status_code != 200:
            print(f"❌ Authentication failed!")
            print(f"Status: {auth_resp.status_code}")
            print(f"Response: {auth_resp.text}")
            return None
        
        data = auth_resp.json()
        
        if "error" in data:
            print(f"❌ Error: {data.get('error_description', data.get('error'))}")
            return None
        
        access_token = data.get("access_token")
        api_server = data.get("api_server")
        
        if not access_token or not api_server:
            print(f"❌ Missing access_token or api_server in response")
            print(f"Response: {json.dumps(data, indent=2)}")
            return None
        
        print(f"✓ Authentication successful!")
        print(f"  API Server: {api_server}")
        print(f"  Token expires in: {data.get('expires_in', 'N/A')} seconds\n")
        
        # Save new refresh token if provided (for next run)
        new_refresh_token = data.get("refresh_token")
        if new_refresh_token:
            try:
                with open("questrade_token.txt", "w") as f:
                    f.write(new_refresh_token)
                print(f"💾 New refresh token saved to questrade_token.txt\n")
            except Exception as e:
                print(f"⚠ Could not save new token: {e}\n")
        
        # Step 2: search for symbol IDs
        print(f"Step 2: Searching for symbol IDs for {symbols}...")
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        
        symbol_list = [s.strip() for s in symbols.split(",")]
        all_ids = []
        
        for symbol in symbol_list:
            search_resp = requests.get(
                f"{api_server}v1/symbols/search",
                headers=headers,
                params={"prefix": symbol},
                timeout=10
            )
            
            if search_resp.status_code == 200:
                search_data = search_resp.json()
                if "symbols" in search_data and len(search_data["symbols"]) > 0:
                    symbol_id = search_data["symbols"][0]["symbolId"]
                    all_ids.append(symbol_id)
                    print(f"  ✓ {symbol} -> ID: {symbol_id}")
                else:
                    print(f"  ⚠ {symbol} not found")
            else:
                print(f"  ❌ Error searching for {symbol}: {search_resp.status_code}")
        
        if not all_ids:
            print("No symbol IDs found!")
            return None
        
        # Step 3: get quotes using symbol IDs
        print(f"\nStep 3: Fetching quotes for IDs {','.join(map(str, all_ids))}...")
        
        quote_resp = requests.get(
            f"{api_server}v1/markets/quotes",
            headers=headers,
            params={"ids": ",".join(map(str, all_ids))},
            timeout=10
        )
        
        if quote_resp.status_code != 200:
            print(f"❌ Failed to fetch quotes!")
            print(f"Status: {quote_resp.status_code}")
            print(f"Response: {quote_resp.text}")
            return None
        
        quotes = quote_resp.json()
        
        print(f"✓ Quotes retrieved successfully!\n")
        
        # Display quotes
        if "quotes" in quotes:
            for quote in quotes["quotes"]:
                symbol = quote.get("symbol", "N/A")
                bid = quote.get("bidPrice", "N/A")
                ask = quote.get("askPrice", "N/A")
                last = quote.get("lastTradePrice", "N/A")
                
                print(f"  {symbol}:")
                print(f"    Bid: ${bid}")
                print(f"    Ask: ${ask}")
                print(f"    Last: ${last}")
                print()
        
        # Save response
        with open("questrade_quotes.json", "w") as f:
            json.dump(quotes, f, indent=2)
        print("Full response saved to questrade_quotes.json")
        
        return quotes
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def main():
    # Get refresh token from: saved file -> env var -> argument
    refresh_token = None
    
    # Try to load from saved token file first
    if os.path.exists("questrade_token.txt"):
        try:
            with open("questrade_token.txt", "r") as f:
                refresh_token = f.read().strip()
                print(f"Loaded refresh token from questrade_token.txt\n")
        except:
            pass
    
    # Check environment variable
    if not refresh_token:
        refresh_token = os.getenv("QUESTRADE_REFRESH_TOKEN")
    
    # Check command line argument
    if not refresh_token and len(sys.argv) > 1:
        refresh_token = sys.argv[1]
    
    if not refresh_token:
        print("Usage: python stockApi.py <REFRESH_TOKEN> [symbols]")
        print("Or set QUESTRADE_REFRESH_TOKEN environment variable")
        print("Or save token to questrade_token.txt and run without args")
        print("\nExample:")
        print("  python stockApi.py 'your_refresh_token_here'")
        print("  python stockApi.py 'your_refresh_token_here' 'AAPL,SHOP.TO'")
        return
    
    # Get symbols from environment or argument
    symbols = os.getenv("QUESTRADE_SYMBOLS", "AAPL,SHOP.TO,AG.TO,ZRE.TO,XEI.TO")
    if len(sys.argv) > 2:
        symbols = sys.argv[2]
    
    test_questrade(refresh_token, symbols)
    
    print(f"\n{'*'*60}\n")

if __name__ == "__main__":
    main()