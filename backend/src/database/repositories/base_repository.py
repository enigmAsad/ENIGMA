"""Base repository with common CRUD operations."""

from typing import Generic, TypeVar, Type, List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, update, delete, func

from src.database.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Base repository with common database operations.

    Provides CRUD operations that can be inherited by specific repositories.
    """

    def __init__(self, model: Type[ModelType], db: Session):
        """Initialize repository.

        Args:
            model: SQLAlchemy model class
            db: Database session
        """
        self.model = model
        self.db = db

    def create(self, obj: ModelType | Dict[str, Any]) -> ModelType:
        """Create a new record.

        Accepts either a SQLAlchemy model instance or a dictionary of field values.

        Args:
            obj: Model instance or data dictionary to insert

        Returns:
            ModelType: Created instance
        """
        if isinstance(obj, dict):
            instance = self.model(**obj)
        else:
            instance = obj

        self.db.add(instance)
        self.db.flush()
        self.db.refresh(instance)
        return instance

    def get_by_id(self, id_value: Any, id_field: str = "id") -> Optional[ModelType]:
        """Get record by ID.

        Args:
            id_value: ID value to search for
            id_field: Name of the ID field (default: 'id')

        Returns:
            Optional[ModelType]: Found instance or None
        """
        stmt = select(self.model).where(getattr(self.model, id_field) == id_value)
        result = self.db.execute(stmt)
        return result.scalar_one_or_none()

    def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None
    ) -> List[ModelType]:
        """Get all records with pagination.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Field to order by

        Returns:
            List[ModelType]: List of instances
        """
        stmt = select(self.model).offset(skip).limit(limit)

        if order_by:
            stmt = stmt.order_by(getattr(self.model, order_by))

        result = self.db.execute(stmt)
        return list(result.scalars().all())

    def update(self, id_value: Any, data: Dict[str, Any], id_field: str = "id") -> Optional[ModelType]:
        """Update a record.

        Args:
            id_value: ID of record to update
            data: Dictionary of fields to update
            id_field: Name of the ID field

        Returns:
            Optional[ModelType]: Updated instance or None
        """
        stmt = (
            update(self.model)
            .where(getattr(self.model, id_field) == id_value)
            .values(**data)
            .returning(self.model)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.scalar_one_or_none()

    def delete(self, id_value: Any, id_field: str = "id") -> bool:
        """Delete a record.

        Args:
            id_value: ID of record to delete
            id_field: Name of the ID field

        Returns:
            bool: True if deleted, False otherwise
        """
        stmt = delete(self.model).where(getattr(self.model, id_field) == id_value)
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount > 0

    def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count records with optional filters.

        Args:
            filters: Dictionary of field:value filters

        Returns:
            int: Number of matching records
        """
        stmt = select(func.count()).select_from(self.model)

        if filters:
            for field, value in filters.items():
                stmt = stmt.where(getattr(self.model, field) == value)

        result = self.db.execute(stmt)
        return result.scalar_one()

    def exists(self, id_value: Any, id_field: str = "id") -> bool:
        """Check if record exists.

        Args:
            id_value: ID value to check
            id_field: Name of the ID field

        Returns:
            bool: True if exists, False otherwise
        """
        stmt = select(func.count()).select_from(self.model).where(
            getattr(self.model, id_field) == id_value
        )
        result = self.db.execute(stmt)
        return result.scalar_one() > 0
