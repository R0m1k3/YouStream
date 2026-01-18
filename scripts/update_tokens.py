import subprocess
import re
import os
import sys
import time

# Paths
BASE_DIR = os.getcwd() # Assumes running from project root
CONFIG_PATH = os.path.join(BASE_DIR, "config", "invidious", "config.yml")

def generate_tokens():
    print("🚀 Starting YouTube Trusted Session Generator (via Docker)...")
    print("This may take a few seconds to pull the image and run...")
    
    try:
        # Run the docker command
        # We use --platform linux/amd64 just in case, though usually auto-detected
        result = subprocess.run(
            ["docker", "run", "--rm", "quay.io/invidious/youtube-trusted-session-generator"],
            capture_output=True,
            text=True,
            check=True
        )
        output = result.stdout
        
        # Debug: Print a bit of output if needed
        # print(output)

        # Regex to find tokens
        visitor_data_match = re.search(r"visitor_data:\s*([^\s]+)", output)
        po_token_match = re.search(r"po_token:\s*([^\s]+)", output)
        
        if not visitor_data_match or not po_token_match:
            print("❌ Error: Could not find tokens in output.")
            print("----------------- OUTPUT BEGIN -----------------")
            print(output)
            print("----------------- OUTPUT END -------------------")
            return None, None
            
        return visitor_data_match.group(1), po_token_match.group(1)

    except subprocess.CalledProcessError as e:
        print(f"❌ Error running Docker: {e}")
        print(f"Stderr: {e.stderr}")
        return None, None
    except FileNotFoundError:
        print("❌ Error: 'docker' command not found. Is Docker installed and in PATH?")
        return None, None

def update_config(visitor_data, po_token):
    print(f"📝 Updating {CONFIG_PATH}...")
    
    if not os.path.exists(CONFIG_PATH):
        print(f"❌ Error: {CONFIG_PATH} not found.")
        return False
        
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    new_lines = []
    po_token_updated = False
    visitor_data_updated = False
    
    # We will try to replace existing lines.
    # If visitor_data was deleted, we'll need to inject it effectively.
    
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("po_token:"):
            new_lines.append(f'po_token: "{po_token}"\n')
            po_token_updated = True
        elif stripped.startswith("visitor_data:"):
            new_lines.append(f'visitor_data: "{visitor_data}"\n')
            visitor_data_updated = True
        else:
            new_lines.append(line)
            
    # If not found (e.g. because we deleted visitor_data), append them to the end of the file
    # or before the end if possible. Appending is safest for YAML if structure allows.
    if not po_token_updated:
        new_lines.append(f'\n# Generated automatically\npo_token: "{po_token}"\n')
    
    if not visitor_data_updated:
        # If we didn't find visitor_data, we append it. 
        # Ideally we'd put it near po_token, but appending works if top-level.
        new_lines.append(f'visitor_data: "{visitor_data}"\n')

    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    print("✅ Config updated successfully.")
    return True

def restart_invidious():
    print("🔄 Restarting Invidious container...")
    try:
        subprocess.run(["docker-compose", "restart", "invidious"], check=True, cwd=BASE_DIR)
        print("✅ Invidious restarted.")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error restarting Invidious: {e}")

if __name__ == "__main__":
    print(f"Working Directory: {BASE_DIR}")
    
    v_data, p_token = generate_tokens()
    
    if v_data and p_token:
        print(f"\n🔑 Generated Tokens:")
        print(f"   visitor_data: {v_data[:15]}...")
        print(f"   po_token:     {p_token[:15]}...")
        
        if update_config(v_data, p_token):
            restart_invidious()
            print("\n🎉 Success! The tokens have been updated and Invidious restarted.")
            print("👉 Please refresh your YouStream page now.")
    else:
        sys.exit(1)
