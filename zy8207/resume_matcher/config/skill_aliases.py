"""
Skill alias normalization configuration.
This module handles mapping different skill representations to standard forms.
"""

from typing import Dict, List, Set

SKILL_ALIAS_MAP: Dict[str, List[str]] = {
    "python": ["python3", "py", "python 3", "python 3.x", "python2", "python 2", "py3", "py2"],
    "javascript": ["js", "ecmascript", "es6", "es5", "javascript es6", "js es6"],
    "typescript": ["ts", "type script", "typescript 4", "typescript 5"],
    "java": ["java 8", "java 11", "java 17", "jdk", "java se"],
    "c++": ["cpp", "c plus plus", "c++11", "c++14", "c++17", "c++20"],
    "c#": ["csharp", "c sharp", "dotnet", ".net", "asp.net"],
    "go": ["golang", "go language", "go lang"],
    "rust": ["rust language", "rust lang"],
    "php": ["php 7", "php 8", "laravel", "symfony"],
    "ruby": ["ruby on rails", "rails", "ror"],
    "swift": ["swift language", "ios swift"],
    "kotlin": ["kotlin language", "android kotlin"],
    "dart": ["dart language", "flutter dart"],
    "sql": ["mysql", "postgresql", "oracle", "sql server", "sqlite", "nosql", "mongodb"],
    "html": ["html5", "html 5"],
    "css": ["css3", "css 3", "sass", "scss", "less", "tailwindcss", "bootstrap"],
    "react": ["reactjs", "react.js", "react native", "react hooks", "redux"],
    "vue": ["vuejs", "vue.js", "vue 2", "vue 3", "vuex", "pinia"],
    "angular": ["angularjs", "angular.js", "angular 2", "angular 4", "angular 8", "angular 12"],
    "node.js": ["nodejs", "node", "express", "express.js", "koa", "nestjs"],
    "django": ["django framework", "django rest framework", "drf"],
    "flask": ["flask framework", "fastapi", "fast api"],
    "spring": ["spring boot", "springboot", "spring cloud", "spring mvc"],
    "docker": ["docker container", "docker compose", "docker swarm"],
    "kubernetes": ["k8s", "kubernetes cluster", "k3s"],
    "aws": ["amazon web services", "ec2", "s3", "lambda", "aws lambda", "aws s3"],
    "azure": ["microsoft azure", "azure cloud", "azure functions"],
    "gcp": ["google cloud platform", "google cloud", "gcp cloud"],
    "git": ["git version control", "github", "gitlab", "bitbucket"],
    "linux": ["linux system", "ubuntu", "centos", "debian", "linux administration"],
    "devops": ["devops engineering", "ci/cd", "continuous integration", "continuous deployment"],
    "machine learning": ["ml", "machine learning algorithms", "supervised learning", "unsupervised learning"],
    "deep learning": ["dl", "neural networks", "cnn", "rnn", "transformer", "bert", "gpt"],
    "data science": ["ds", "data analysis", "data visualization", "pandas", "numpy", "scikit-learn"],
    "nlp": ["natural language processing", "nlp processing", "text processing"],
    "computer vision": ["cv", "image processing", "object detection", "image recognition"],
    "testing": ["test automation", "automated testing", "unit testing", "integration testing", "selenium", "pytest", "jest"],
    "agile": ["agile methodology", "scrum", "kanban", "sprint"],
    "microservices": ["microservice architecture", "micro services", "service oriented architecture", "soa"],
    "api": ["rest api", "restful api", "graphql", "soap", "api development"],
    "security": ["cyber security", "information security", "web security", "network security", "oauth", "jwt"],
    "database": ["db", "database management", "database design", "rdbms", "relational database"],
    "mobile": ["mobile development", "ios", "android", "react native", "flutter"],
    "frontend": ["front end", "front-end", "client side", "client-side"],
    "backend": ["back end", "back-end", "server side", "server-side"],
    "fullstack": ["full stack", "full-stack", "full stack development"],
}

STANDARD_SKILLS: Set[str] = set(SKILL_ALIAS_MAP.keys())


def get_skill_aliases() -> Dict[str, List[str]]:
    """Get the skill alias mapping."""
    return SKILL_ALIAS_MAP.copy()


def get_standard_skills() -> Set[str]:
    """Get the set of standard skill names."""
    return STANDARD_SKILLS.copy()


def build_reverse_alias_map() -> Dict[str, str]:
    """
    Build a reverse mapping from alias to standard skill name.
    """
    reverse_map = {}
    for standard, aliases in SKILL_ALIAS_MAP.items():
        reverse_map[standard.lower()] = standard
        for alias in aliases:
            reverse_map[alias.lower()] = standard
    return reverse_map
