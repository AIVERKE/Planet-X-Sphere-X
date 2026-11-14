from fastapi import APIRouter

from schemas.example import ExampleResponse

router = APIRouter(prefix="/example", tags=["example"])


@router.get("", response_model=ExampleResponse)
def read_example() -> ExampleResponse:
    return ExampleResponse(message="Hello from Planet-X Sphere-X")
