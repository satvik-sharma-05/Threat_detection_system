#!/usr/bin/env python3
"""
Test that extracted entities are being stored and displayed correctly
"""
import requests
import json

API_URL = "http://localhost:8000"

def test_conversation_entities():
    """Test that conversations include extracted entities"""
    print("🔍 Testing conversation entity storage...")
    
    try:
        # Get conversations
        response = requests.get(f"{API_URL}/conversations")
        if response.status_code == 200:
            data = response.json()
            conversations = data.get('conversations', [])
            
            if conversations:
                conv = conversations[0]  # Get first conversation
                print(f"✅ Found conversation #{conv['id']}")
                
                # Check if extracted_entities field exists
                if 'extracted_entities' in conv:
                    print("✅ extracted_entities field present")
                    entities = conv['extracted_entities']
                    
                    if entities:
                        print("📊 Extracted entities found:")
                        for entity_type, entity_list in entities.items():
                            if isinstance(entity_list, list) and len(entity_list) > 0:
                                print(f"   - {entity_type}: {len(entity_list)} items")
                                if entity_type == 'persons' and len(entity_list) > 0:
                                    print(f"     Example: {entity_list[0].get('name', 'Unknown')}")
                                elif entity_type == 'locations' and len(entity_list) > 0:
                                    print(f"     Example: {entity_list[0].get('name', 'Unknown')}")
                    else:
                        print("⚠️  extracted_entities is empty")
                else:
                    print("❌ extracted_entities field missing")
                
                # Test detailed view
                print(f"\n🔍 Testing detailed view for conversation #{conv['id']}...")
                detail_response = requests.get(f"{API_URL}/conversations/{conv['id']}")
                if detail_response.status_code == 200:
                    detail = detail_response.json()
                    if 'extracted_entities' in detail:
                        print("✅ Detailed view includes extracted_entities")
                        entities = detail['extracted_entities']
                        if entities:
                            print("📋 Available entity types:")
                            for entity_type in entities.keys():
                                print(f"   - {entity_type}")
                        else:
                            print("⚠️  Detailed extracted_entities is empty")
                    else:
                        print("❌ Detailed view missing extracted_entities")
                else:
                    print(f"❌ Failed to get detailed view: {detail_response.status_code}")
            else:
                print("❌ No conversations found")
        else:
            print(f"❌ Failed to get conversations: {response.status_code}")
    
    except Exception as e:
        print(f"❌ Error: {e}")

def test_new_upload_storage():
    """Test that new uploads store extracted entities"""
    print("\n🧪 Testing new upload entity storage...")
    
    # Create a sample audio-like file (text file for testing)
    sample_text = """Hello, this is John calling about the meeting tomorrow at 3 PM. 
    I'll bring the blue Toyota with license plate ABC-123. 
    Sarah mentioned we need $5000 for the operation. 
    The weapons are stored at the warehouse on 5th Street."""
    
    try:
        # Note: This will fail because text files aren't supported by Groq Whisper
        # But we can check the error message to confirm the system is working
        with open("test_sample.txt", "w") as f:
            f.write(sample_text)
        
        with open("test_sample.txt", "rb") as f:
            files = {"file": ("test_sample.txt", f, "text/plain")}
            response = requests.post(f"{API_URL}/upload", files=files)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Upload successful!")
            print(f"   Conversation ID: {result['conversation_id']}")
            
            # Check if auto_detected includes all entity types
            detected = result.get('auto_detected', {})
            print("📊 Auto-detected entities:")
            for entity_type, entities in detected.items():
                if isinstance(entities, list):
                    print(f"   - {entity_type}: {len(entities)} items")
        else:
            print(f"⚠️  Upload failed (expected for text files): {response.status_code}")
            error_detail = response.json().get('detail', 'Unknown error')
            if 'file must be one of the following types' in error_detail:
                print("✅ System correctly rejects non-audio files")
            else:
                print(f"   Error: {error_detail}")
    
    except Exception as e:
        print(f"❌ Error in upload test: {e}")

if __name__ == "__main__":
    print("🧪 Testing Entity Storage and Display")
    print("=" * 50)
    
    test_conversation_entities()
    test_new_upload_storage()
    
    print("\n" + "=" * 50)
    print("🎯 Test completed!")
    print("\n📋 Next Steps:")
    print("1. Upload a new English audio file to test entity extraction")
    print("2. Check Analysis History to see all detected entities")
    print("3. Verify that vehicles, money, dates, etc. are displayed")