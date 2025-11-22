import sys
import os
import hashlib
import json

"""
PLEXO INSPECTOR (Semantic Core)
Technique: JSON Canonicalization & Deterministic Hashing
"""

def read_json_canonical(filepath):
    """
    Loads JSON and dumps it back with sorted keys.
    This ensures {"a": 1, "b": 2} == {"b": 2, "a": 1}
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # separators=(',', ':') removes whitespace for compact hashing
            return json.dumps(data, sort_keys=True, separators=(',', ':'))
    except:
        return None

def read_raw_bytes(filepath):
    try:
        with open(filepath, 'rb') as f:
            return f.read()
    except:
        return None

def main():
    # Loop over stdin lines
    for line in sys.stdin:
        try:
            req = json.loads(line)
            cmd = req.get('command')
            
            if cmd == 'compare':
                src, tgt = req['source'], req['target']
                status = "DIFFERENT"
                d_type = "BINARY"

                # 1. Attempt Semantic Comparison (JSON)
                # Only if both are JSON extensions
                if src.endswith('.json') and tgt.endswith('.json'):
                    s_canon = read_json_canonical(src)
                    t_canon = read_json_canonical(tgt)
                    
                    if s_canon is not None and t_canon is not None:
                        d_type = "SEMANTIC"
                        if s_canon == t_canon:
                            status = "SAME"
                        # Short-circuit logic complete
                
                # 2. Fallback to Binary Hash (MD5) if not JSON or JSON parsing failed
                if d_type == "BINARY" or (status == "DIFFERENT" and d_type == "SEMANTIC" and s_canon is None):
                    # If semantic check failed due to parse error, fallback to raw
                    s_bytes = read_raw_bytes(src)
                    t_bytes = read_raw_bytes(tgt)
                    
                    if s_bytes and t_bytes:
                        if hashlib.md5(s_bytes).hexdigest() == hashlib.md5(t_bytes).hexdigest():
                            status = "SAME"
                        d_type = "BINARY"

                # Output strictly one line of JSON
                print(json.dumps({"status": status, "diff_type": d_type}))
                sys.stdout.flush()

        except Exception:
            # Protocol must not break even on critical failures
            print(json.dumps({"status": "ERROR", "diff_type": "BINARY"}))
            sys.stdout.flush()

if __name__ == "__main__":
    main()