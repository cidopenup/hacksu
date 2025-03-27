import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Keys
IMAGGA_API_KEY = os.getenv('IMAGGA_API_KEY')
IMAGGA_API_SECRET = os.getenv('IMAGGA_API_SECRET')

# Imagga API Endpoints
IMAGGA_API_URL = "https://api.imagga.com/v2" 