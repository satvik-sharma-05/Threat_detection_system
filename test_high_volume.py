#!/usr/bin/env python3
"""
Test script for high-volume processing functionality
"""
import requests
import json
import time
import os

API_URL = "http://localhost:8000"

def test_processing_status():
    """Test processing status endpoint"""
    print("🔍 Testing processing status endpoint...")
    try:
        response = requests.get(f"{API_URL}/processing/status")
        if response.status_code == 200:
            data = response.json()
            print("✅ Processing status endpoint working")
            print(f"   Queue stats: {data['queue_stats']}")
            print(f"   System status: {data['system_status']}")
            return True
        else:
            print(f"❌ Processing status failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Processing status error: {e}")
        return False

def test_tasks_endpoint():
    """Test tasks endpoint"""
    print("\n🔍 Testing tasks endpoint...")
    try:
        response = requests.get(f"{API_URL}/processing/tasks")
        if response.status_code == 200:
            data = response.json()
            print("✅ Tasks endpoint working")
            print(f"   Task summary: {data['summary']}")
            return True
        else:
            print(f"❌ Tasks endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Tasks endpoint error: {e}")
        return False

def test_directory_endpoint():
    """Test directory endpoint"""
    print("\n🔍 Testing directory endpoint...")
    try:
        response = requests.get(f"{API_URL}/files/directory")
        if response.status_code == 200:
            data = response.json()
            print("✅ Directory endpoint working")
            print(f"   Directory info: {data['directory_info']}")
            print(f"   Total files: {len(data['files'])}")
            print(f"   Audio files: {len(data['audio_files'])}")
            return True
        else:
            print(f"❌ Directory endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Directory endpoint error: {e}")
        return False

def test_file_watcher_control():
    """Test file watcher control endpoints"""
    print("\n🔍 Testing file watcher control...")
    try:
        # Test start
        response = requests.post(f"{API_URL}/files/watch/start")
        if response.status_code == 200:
            print("✅ File watcher start working")
        else:
            print(f"❌ File watcher start failed: {response.status_code}")
            return False
        
        # Test stop
        response = requests.post(f"{API_URL}/files/watch/stop")
        if response.status_code == 200:
            print("✅ File watcher stop working")
            return True
        else:
            print(f"❌ File watcher stop failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ File watcher control error: {e}")
        return False

def test_processing_control():
    """Test processing control endpoints"""
    print("\n🔍 Testing processing control...")
    try:
        # Test start
        response = requests.post(f"{API_URL}/processing/start")
        if response.status_code == 200:
            print("✅ Processing start working")
        else:
            print(f"❌ Processing start failed: {response.status_code}")
            return False
        
        # Test stop
        response = requests.post(f"{API_URL}/processing/stop")
        if response.status_code == 200:
            print("✅ Processing stop working")
            return True
        else:
            print(f"❌ Processing stop failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Processing control error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing High-Volume Processing System")
    print("=" * 50)
    
    # Check if server is running
    try:
        response = requests.get(f"{API_URL}/")
        if response.status_code != 200:
            print("❌ Server not running. Please start with: python backend/main.py")
            return
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        print("Please start the server with: python backend/main.py")
        return
    
    print("✅ Server is running")
    
    # Run tests
    tests = [
        test_processing_status,
        test_tasks_endpoint,
        test_directory_endpoint,
        test_file_watcher_control,
        test_processing_control
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"🎯 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All high-volume processing features are working!")
        print("\n📋 Next Steps:")
        print("1. Start the frontend: cd frontend && npm start")
        print("2. Visit http://localhost:3001/batch-upload")
        print("3. Upload multiple audio files or ZIP archives")
        print("4. Monitor progress in real-time")
    else:
        print("⚠️  Some tests failed. Check the error messages above.")

if __name__ == "__main__":
    main()