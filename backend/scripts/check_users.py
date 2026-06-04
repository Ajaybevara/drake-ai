from app.core.database import SessionLocal
from app.models import User

db = SessionLocal()
users = db.query(User).all()
print([u.email for u in users])
db.close()
