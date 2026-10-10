variable "region" {
  type    = string
  default = "us-east-1"
}

variable "name" {
  type    = string
  default = "cms"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "certificate_arn" {
  type        = string
  description = "Certificado ACM para el HTTPS del balanceador"
}

variable "api_image" {
  type        = string
  description = "Imagen de la API en ECR"
}

variable "web_image" {
  type        = string
  description = "Imagen del frontend en ECR"
}

variable "azs" {
  type        = list(string)
  description = "Zonas de disponibilidad fijas para que el plan no cambie si AWS agrega una"
  default     = ["us-east-1a", "us-east-1b"]
}