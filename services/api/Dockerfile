FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv/api
COPY services/api/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt "uvicorn[standard]"
COPY services/api/ ./
COPY packages/contracts /srv/packages/contracts
ENV APS_CURRICULUM_PATH=/srv/packages/contracts/curriculum.json
RUN useradd --system --uid 10001 aps && chown -R aps /srv
USER aps
EXPOSE 8000
# Migrate, seed curriculum (idempotent), then serve.
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
