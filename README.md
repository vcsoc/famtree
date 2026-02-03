# FamTree - Family Tree Manager

Full-stack family tree building and management application with AI integration for genealogy research, multi-image support, and advanced export/import capabilities.

## ✨ Latest Features (February 2026)

### 🖼️ Multi-Image Support
- **Multiple Photos per Person** - Add unlimited photos to each person profile
- **Primary Image Selection** - Choose which photo appears on the tree canvas
- **Drag & Drop Upload** - Drag images directly onto person nodes in the canvas
- **Image Gallery** - View all photos for a person in an organized gallery
- **Automatic Thumbnails** - 120x120 thumbnails generated for optimal performance

### 📁 .famtree File Format
- **Complete Tree Export** - Export entire family trees with all data and images
- **Embedded Images** - Photos are base64-encoded and included in the export file
- **Portable Format** - Single file contains everything (people, relationships, images)
- **Import Options**:
  - **Overwrite Mode** - Replace existing tree data with imported tree
  - **New Tree Mode** - Import as a brand new tree in the forest
- **Drag & Drop Import** - Drop .famtree files directly onto the canvas
- **Custom Confirmation Dialogs** - Choose how to import with clear options

### 📊 Live Metrics & Activity Tracking
- **Active Users Counter** - Real-time count of users active in last 5 minutes
- **10-Second Polling** - Live updates every 10 seconds
- **Activity Tracking Middleware** - Automatic user activity logging
- **Database-Backed** - User activity stored in dedicated table

### 🎨 UI Enhancements
- **Sticky Blade Actions** - Save/Cancel buttons always visible at bottom of editor
- **Streamlined Navigation** - Removed redundant navigation buttons
- **Tree Deletion** - Delete trees with confirmation dialog
- **Visual Drag Feedback** - Clear overlay when dragging .famtree files
- **Improved Layouts** - Better flexbox-based blade editor design

## Features Implemented

### Core Functionality
✅ **Multi-Tenant Architecture** - Tenants → Forests → Trees hierarchy
✅ **Authentication & RBAC** - Full role-based access control (Admin, Warden, Ranger, Arborist, Visitor)
✅ **Forest Management** - Create and organize multiple family tree collections
✅ **Tree Management** - Build, manage, and delete individual family trees within forests
✅ **Live Activity Metrics** - Real-time active user tracking

### Family Tree Builder
✅ **Interactive Tree Visualization** - Drag-and-drop person nodes with visual relationship links
✅ **Multi-Image Person Profiles** - Detailed person information including:
  - Names (first, middle, last, maiden)
  - Birth and death dates/places
  - Biography
  - **Multiple photos with primary selection**
  - Gender
✅ **Relationship Management** - Create parent-child, spouse, and other relationships
✅ **Life Timeline** - Track and display life events chronologically
✅ **Stories & Memories** - Add family stories and memories to each person
✅ **Drag & Drop Images** - Drag images onto canvas nodes to add photos

### Import/Export Features
✅ **.famtree Format** - Custom file format with embedded images
✅ **Export Complete Trees** - Download full tree with all data and photos
✅ **Import with Options** - Overwrite existing or create new tree
✅ **Drag & Drop Import** - Drop .famtree files onto canvas
✅ **Visual Import Feedback** - Clear overlay and confirmation dialogs

### Collaboration Features
✅ **Invitation System** - Invite family members via email with role-specific permissions
✅ **Granular Permissions** - Control access at forest and tree levels
✅ **Shared Editing** - Multiple users can collaborate on the same tree

### AI Integration
✅ **AI Research Assistant** - Connect to multiple AI providers:
  - OpenAI
  - Anthropic
  - Google AI
  - LM Studio (local)
  - Ollama (local)
✅ **Research Task Types**:
  - Genealogy research
  - Historical records search
  - DNA analysis
  - Timeline generation
  - Name suggestions

### Additional Features
✅ **Settings & Preferences** - Customize themes and layouts
✅ **Export Options** - Export family trees (PDF, GEDCOM, JSON - UI ready)
✅ **Responsive Design** - Works on desktop and mobile
✅ **Custom CSS Styling** - Modern, dark-themed interface

## Technology Stack

- **Frontend**: Next.js 14 (TypeScript, App Router)
- **Backend**: Node.js/Express (TypeScript)
- **Database**: SQLite with async driver
- **Authentication**: JWT with bcrypt
- **Image Processing**: Sharp 0.33.x for thumbnails and optimization
- **File Uploads**: Multer with memory storage
- **Styling**: Custom CSS (no framework dependencies)

## File Upload Configuration

- **Images**: 10MB limit per file (JPEG, PNG, GIF, WebP)
- **.famtree Files**: 100MB limit (allows large family trees with many photos)
- **Storage**: Local filesystem in `server/uploads/` directory
- **Thumbnails**: Auto-generated 120x120 JPEG thumbnails for all images

## Prerequisites

- Node.js 20+
- npm 10+

## Local Development

```bash
# Install dependencies
npm install

# Start dev servers (web + API)
npm run dev
```

- **Web**: http://localhost:3003 (auto-increments if ports busy)
- **API**: http://localhost:4001

## Docker Deployment

### Quick Start

```bash
# Build and start all services
docker compose up --build

# Run in detached mode (background)
docker compose up -d --build

# Stop services
docker compose down

# Stop and remove volumes (⚠️ deletes database)
docker compose down -v
```

- **Web**: http://localhost:3000
- **API**: http://localhost:4000

### Docker Volume Configuration

The application uses Docker volumes to persist data. By default, Docker manages these volumes internally, but you can map them to local directories for easier access and backups.

#### Default Configuration (Docker-managed volumes)
```yaml
volumes:
  famtree-data:  # Docker manages this volume
```

#### Map to Local Directories

**Windows (PowerShell/CMD)**
```yaml
volumes:
  api:
    volumes:
      - C:\Users\YourUsername\famtree-data:/data
      - C:\Users\YourUsername\famtree-uploads:/app/uploads
```

**Windows (WSL2)**
```yaml
volumes:
  api:
    volumes:
      - /mnt/c/Users/YourUsername/famtree-data:/data
      - /mnt/c/Users/YourUsername/famtree-uploads:/app/uploads
```

**Linux**
```yaml
volumes:
  api:
    volumes:
      - /home/youruser/famtree-data:/data
      - /home/youruser/famtree-uploads:/app/uploads
```

**macOS**
```yaml
volumes:
  api:
    volumes:
      - /Users/youruser/famtree-data:/data
      - /Users/youruser/famtree-uploads:/app/uploads
```

#### Complete docker-compose.yml with Local Volumes

<details>
<summary>Click to expand example configuration</summary>

```yaml
services:
  web:
    build:
      context: ./web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_BASE=http://localhost:4000
    depends_on:
      - api

  api:
    build:
      context: ./server
    ports:
      - "4000:4000"
    environment:
      - PORT=4000
      - JWT_SECRET=change-this-secret-key-in-production
      - DB_PATH=/data/famtree.db
    volumes:
      # Replace with your platform-specific paths
      # Windows: C:\Users\YourName\famtree-data:/data
      # Linux: /home/youruser/famtree-data:/data
      # macOS: /Users/youruser/famtree-data:/data
      - ./famtree-data:/data
      - ./famtree-uploads:/app/uploads

# If using Docker-managed volumes instead:
# volumes:
#   famtree-data:
```
</details>

### Docker Volume Management

**List volumes**
```bash
docker volume ls
```

**Inspect a volume**
```bash
docker volume inspect famtree_famtree-data
```

**Backup database (Docker-managed volume)**
```bash
# Copy from container to local directory
docker compose cp api:/data/famtree.db ./backup/

# Or create a backup while running
docker compose exec api tar czf - /data | tar xzf - -C ./backup/
```

**Restore database**
```bash
# Copy to container
docker compose cp ./backup/famtree.db api:/data/

# Restart to apply
docker compose restart api
```

### Dockerfile Details

The project includes multi-stage Dockerfiles for optimized builds:

**web/Dockerfile** (Next.js)
- Stage 1: Install production dependencies
- Stage 2: Build Next.js application
- Stage 3: Run with minimal footprint (node:20-alpine)

**server/Dockerfile** (Node.js/TypeScript)
- Stage 1: Install production dependencies
- Stage 2: Build TypeScript to JavaScript
- Stage 3: Run compiled code with minimal footprint

### Development with Docker

For development with hot-reload:

```bash
# Use docker-compose.dev.yml if available, or:
docker compose -f docker-compose.yml up --build

# View logs
docker compose logs -f

# Access shell in running container
docker compose exec api sh
docker compose exec web sh
```

## Environment Variables

### Server (.env in server/ directory)
```env
PORT=4001
JWT_SECRET=your-secret-key-change-this
DB_PATH=./data/famtree.db
```

### Web (.env.local in web/ directory)
```env
NEXT_PUBLIC_API_BASE=http://localhost:4001
```

## Getting Started

### First Time Setup

1. **Start the Application**
   ```bash
   npm install
   npm run dev
   ```
   - Web UI: http://localhost:3003
   - API: http://localhost:4001

2. **Register First Admin Account**
   - Navigate to home page
   - Click "Need an account?"
   - Enter email, password (8+ chars), and optional tenant name
   - First user becomes Admin automatically

### Building Your Family Tree

3. **Create a Forest**
   - After login, click "My Forests"
   - Click "Create forest"
   - Enter a name (e.g., "Smith Family Collection")
   - Click the forest to open it

4. **Create Your First Tree**
   - Inside the forest, enter a tree name (e.g., "Smith Family Tree")
   - Click "Create tree"
   - Click the tree to open the canvas editor

5. **Add Family Members**
   - Click "+ Add person" in the canvas
   - Fill in details:
     - First name, middle name, last name
     - Birth and death dates
     - Gender
     - Biography
   - Click "Save" to add the person to the tree

6. **Add Photos to People**
   - **Method 1 - Drag & Drop**: Drag an image file onto a person node in the canvas
   - **Method 2 - Blade Editor**: Click a person to open the blade, then drag images into the gallery
   - **Set Primary Photo**: Click "Set as Primary" on any photo to make it the main profile picture
   - **Multiple Photos**: Add as many photos as you want to each person

7. **Create Relationships**
   - Click the "+" button on a person node
   - Select relationship type (Parent, Child, Spouse, Sibling)
   - Choose the person to connect to
   - The relationship line appears on the canvas

8. **Organize Your Tree**
   - Drag person nodes to arrange the layout
   - Positions are saved automatically
   - Zoom in/out with mouse wheel
   - Pan by dragging the canvas background

### Export & Import Trees

9. **Export a Tree**
   - Open the tree you want to export
   - Click "Export Tree" (↓ icon)
   - A .famtree file downloads with all data and images
   - This file can be shared with family members

10. **Import a Tree**
    - **Method 1 - Replace Existing Tree**:
      - Open the tree you want to replace
      - Drag and drop a .famtree file onto the canvas
      - Choose "Overwrite this tree" in the confirmation dialog
    - **Method 2 - Create New Tree**:
      - Open any tree or forest
      - Drag and drop a .famtree file onto the canvas
      - Choose "Import as new tree" in the confirmation dialog

### Collaboration

11. **Invite Family Members**
    - Go to "Invite" page
    - Enter email address
    - Select role:
      - **Admin** - Full control of everything
      - **Warden** - Manage forests and trees
      - **Ranger** - Manage trees
      - **Arborist** - Edit people and relationships
      - **Visitor** - View only
    - Choose which forest to grant access to
    - Click "Send Invitation"

12. **Accept Invitations** (For invited users)
    - Check email for invitation link
    - Click the link
    - Register with email and password
    - You'll be added to the forest automatically

### Tree Management

13. **Rename a Tree**
    - Go to the forest containing the tree
    - Click "Rename" next to the tree name
    - Enter new name and press Enter or click "Save"

14. **Delete a Tree**
    - Go to the forest containing the tree
    - Click "Delete" next to the tree
    - Confirm deletion in the dialog
    - ⚠️ **Warning**: This permanently deletes all people, relationships, and images

### Activity Monitoring

15. **View Active Users**
    - Look at the top bar
    - See "Active Users: X" showing users active in last 5 minutes
    - Updates every 10 seconds automatically

## Database Schema

- **tenants** - Organizations
- **users** - User accounts with roles
- **user_activity** - User activity tracking for live metrics (NEW)
- **forests** - Collections of trees
- **trees** - Individual family trees
- **people** - Family members in trees
- **person_images** - Multiple photos per person with primary flag (NEW)
- **relationships** - Connections between people
- **life_events** - Timeline events for people
- **media** - Photos and files
- **stories** - Family stories and memories
- **invitations** - Collaboration invites
- **ai_tasks** - AI research tasks

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/me` - Get current user

### Metrics (NEW)
- `GET /api/active-users` - Get count of active users (5 min window)

### Resources
- `GET/POST /api/forests` - Forest management
- `PUT /api/forests/:id` - Update forest name
- `GET/POST /api/trees` - Tree management
- `PUT /api/trees/:id` - Update tree name
- `DELETE /api/trees/:treeId` - Delete tree and all data (NEW)
- `GET/POST/PUT/DELETE /api/people` - Person CRUD
- `GET/POST/DELETE /api/relationships` - Relationship management
- `GET/POST /api/events` - Life events
- `GET/POST /api/stories` - Family stories

### Images (NEW)
- `POST /api/upload` - Upload single image
- `POST /api/people/:personId/images` - Add image to person
- `DELETE /api/people/:personId/images/:imageId` - Delete image
- `PUT /api/people/:personId/images/:imageId/primary` - Set primary image

### Import/Export (NEW)
- `GET /api/trees/:treeId/export-famtree` - Export tree as .famtree file
- `POST /api/trees/:treeId/import-famtree?mode=overwrite` - Import into existing tree
- `POST /api/forests/:forestId/import-famtree-new` - Import as new tree

### Other
- `POST /api/invitations` - Send invites
- `POST /api/invitations/:token/accept` - Accept invite
- `POST /api/ai/tasks` - Queue AI research

## Scripts

- `npm run dev` - Start web + API in dev mode
- `npm run build` - Build for production
- `npm run start` - Start production servers
- `npm run lint` - Lint frontend code

## Architecture

```
famtree/
├── web/                 # Next.js frontend
│   ├── app/            # App router pages
│   │   ├── forests/    # Forest management
│   │   ├── trees/      # Tree builder
│   │   ├── people/     # Person profiles
│   │   ├── ai-research/# AI research assistant
│   │   ├── invite/     # Invitations
│   │   └── settings/   # Settings
│   └── globals.css     # Custom styles
├── server/             # Express API
│   └── src/
│       ├── db.ts       # Database setup
│       ├── auth.ts     # JWT auth
│       ├── rbac.ts     # Role checks
│       ├── routes.ts   # API routes
│       └── index.ts    # Server entry
└── docker-compose.yml  # Container setup
```

## Future Enhancements (From Spec)

- DNA test integration (Ancestry, 23andMe)
- Map visualization for migration patterns
- Historical timeline with world events
- Virtual reunion video calls
- Family history book generation
- Legacy & will integration
- Multilingual support
- Theme customization UI
- Advanced AI predictions
- Professional genealogist marketplace

## Recent Updates

### February 2026
- ✅ Multi-image support with drag & drop onto canvas nodes
- ✅ Primary image selection for person profiles
- ✅ .famtree file format with embedded images
- ✅ Export/import trees with overwrite and new tree modes
- ✅ Drag & drop .famtree files onto canvas
- ✅ Custom confirmation dialogs with no auto-hide
- ✅ Live active users metric (replacing static statistics)
- ✅ User activity tracking middleware
- ✅ Sticky blade editor buttons
- ✅ Tree deletion functionality
- ✅ Streamlined forest management UI
- 🐛 Fixed .famtree import constraint error (relationships.tree_id)

## Known Issues & Fixes

- **Fixed**: Import error "SQLITE_CONSTRAINT: NOT NULL constraint failed: relationships.tree_id"
  - Solution: Added tree_id parameter to relationship INSERT statements in both import endpoints
- **Fixed**: Blade buttons scrolling out of view
  - Solution: Flexbox layout with sticky positioning for blade-actions
- **Fixed**: .famtree files rejected with "Only image files allowed"
  - Solution: Separate multer instance for .famtree files with correct file filter

## License

Proprietary - All rights reserved

## Support

For issues or questions, please contact the development team.
