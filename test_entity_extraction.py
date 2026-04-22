#!/usr/bin/env python3
"""
Test entity extraction with sample conversation
"""
import requests
import json

API_URL = "http://localhost:8000"

def test_entity_extraction():
    """Test entity extraction with a sample conversation"""
    
    # Get existing conversations to see what's being extracted
    print("🔍 Fetching existing conversations...")
    try:
        response = requests.get(f"{API_URL}/conversations")
        if response.status_code == 200:
            data = response.json()
            conversations = data.get('conversations', [])
            
            if conversations:
                print(f"✅ Found {len(conversations)} conversations")
                
                # Check the first conversation for entity extraction
                conv = conversations[0]
                print(f"\n📋 Conversation #{conv['id']}:")
                print(f"   Transcript: {conv['transcript'][:100]}...")
                print(f"   Persons detected: {len(conv['persons'])}")
                print(f"   Decoded codes: {len(conv['decoded_codes'])}")
                print(f"   Threat score: {conv['threat_score']}")
                
                if conv['persons']:
                    print("   👥 Persons found:")
                    for person in conv['persons']:
                        print(f"      - {person['name']}")
                else:
                    print("   ❌ No persons detected")
                
                if conv['location']:
                    print(f"   📍 Location: {conv['location']['name']}")
                else:
                    print("   ❌ No location detected")
                
                # Get detailed view
                print(f"\n🔍 Getting detailed view of conversation #{conv['id']}...")
                detail_response = requests.get(f"{API_URL}/conversations/{conv['id']}")
                if detail_response.status_code == 200:
                    detail = detail_response.json()
                    
                    print(f"   Full transcript: {detail['transcript']}")
                    print(f"   Persons: {len(detail['persons'])}")
                    print(f"   Decoded codes: {len(detail['decoded_codes'])}")
                    print(f"   Connections: {len(detail.get('connections', []))}")
                    
                    if detail['persons']:
                        print("   👥 Detailed persons:")
                        for person in detail['persons']:
                            print(f"      - {person['name']} (Threat: {person['threat_score']}, Crime: {person['crime_type']})")
                    
                    if detail['decoded_codes']:
                        print("   🔓 Decoded codes:")
                        for code in detail['decoded_codes']:
                            print(f"      - '{code['term']}' → {code['decoded_meaning']}")
                
            else:
                print("❌ No conversations found. Upload an audio file first.")
        else:
            print(f"❌ Failed to fetch conversations: {response.status_code}")
    
    except Exception as e:
        print(f"❌ Error: {e}")

def test_sample_upload():
    """Test with a sample text file to see entity extraction"""
    print("\n🧪 Testing entity extraction with sample text...")
    
    # Create a sample text file with clear entities
    sample_text = """Hello John, this is Mike. I need you to meet me at Central Park tomorrow at 3 PM. 
    Bring the package from the warehouse on 5th Street. 
    Tell Sarah and Ahmed that the operation is moving forward. 
    We have $50,000 ready for the transaction. 
    The boss wants this done by Friday. 
    Use the blue Toyota with license plate ABC-123."""
    
    try:
        # Save as text file
        with open("sample_conversation.txt", "w") as f:
            f.write(sample_text)
        
        # Upload the text file
        with open("sample_conversation.txt", "rb") as f:
            files = {"file": ("sample_conversation.txt", f, "text/plain")}
            response = requests.post(f"{API_URL}/upload", files=files)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Sample upload successful!")
            print(f"   Conversation ID: {result['conversation_id']}")
            print(f"   Threat score: {result['threat_assessment']['score']}")
            
            # Check detected entities
            detected = result.get('auto_detected', {})
            
            print(f"\n📊 Entity Extraction Results:")
            print(f"   Persons: {len(detected.get('persons', []))}")
            print(f"   Locations: {len(detected.get('locations', []))}")
            print(f"   Organizations: {len(detected.get('organizations', []))}")
            print(f"   Vehicles: {len(detected.get('vehicles', []))}")
            print(f"   Money: {len(detected.get('money', []))}")
            print(f"   Decoded codes: {len(detected.get('decoded_codes', []))}")
            
            if detected.get('persons'):
                print("   👥 Persons detected:")
                for person in detected['persons']:
                    print(f"      - {person['name']} ({person.get('role', 'Unknown role')})")
            
            if detected.get('locations'):
                print("   📍 Locations detected:")
                for location in detected['locations']:
                    print(f"      - {location['name']} ({location.get('context', 'Unknown context')})")
            
            if detected.get('money'):
                print("   💰 Money detected:")
                for money in detected['money']:
                    print(f"      - {money['amount']} ({money.get('purpose', 'Unknown purpose')})")
            
            if detected.get('vehicles'):
                print("   🚗 Vehicles detected:")
                for vehicle in detected['vehicles']:
                    print(f"      - {vehicle['type']} ({vehicle.get('details', 'No details')})")
        
        else:
            print(f"❌ Sample upload failed: {response.status_code}")
            print(f"   Error: {response.text}")
    
    except Exception as e:
        print(f"❌ Error in sample upload: {e}")

if __name__ == "__main__":
    print("🧪 Testing Entity Extraction")
    print("=" * 50)
    
    test_entity_extraction()
    test_sample_upload()
    
    print("\n" + "=" * 50)
    print("🎯 Test completed!")